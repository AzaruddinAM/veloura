<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductPhoto;
use App\Support\ProductImage;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ProductController extends Controller
{
    private const IMAGE_RULES = ['file', 'mimes:jpg,jpeg,png,webp,avif,gif', 'max:8192'];

    public function __construct(private ProductImage $images) {}

    public function index()
    {
        return Product::with(['category', 'photos'])->orderBy('sort')->orderBy('id')->get()->map->toAdmin();
    }

    /** New product with one or more photos (photos[0] is the cover). Sent as multipart. */
    public function store(Request $request)
    {
        $data = $request->validate([
            ...$this->detailRules(),
            'photos' => ['required', 'array', 'min:1', 'max:10'],
            'photos.*.image' => ['required', ...self::IMAGE_RULES],
            ...$this->cropRules('photos.*.'),
        ]);

        $made = [];
        try {
            foreach ($data['photos'] as $i => $p) {
                $made[] = $this->make($request->file("photos.$i.image"), $this->crop($p), $p['theme'] ?? null, "photos.$i.image");
            }
            $product = DB::transaction(function () use ($data, $request, $made) {
                $product = Product::create($this->details($data, $request));
                foreach ($made as $sort => $attrs) {
                    $product->photos()->create([...$attrs, 'sort' => $sort]);
                }

                return $product;
            });
        } catch (\Throwable $e) {
            foreach ($made as $m) {
                $this->images->deleteIfUnused($m['image_key'], $m['image_original']);
            }
            throw $e;
        }

        return response()->json($this->fresh($product), 201);
    }

    /** Edit the details. Photos have their own endpoints below. */
    public function update(Request $request, Product $product)
    {
        $product->update($this->details($request->validate($this->detailRules()), $request));

        return $this->fresh($product);
    }

    /** Quick changes from the list: show/hide, display order, price, stock. */
    public function patch(Request $request, Product $product)
    {
        $product->update($request->validate([
            'is_active' => ['sometimes', 'boolean'],
            'sort' => ['sometimes', 'integer', 'min:0', 'max:65535'],
            'price' => ['sometimes', 'integer', 'min:1', 'max:10000000', 'lte:'.$product->was_price],
            'stock' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000'],
        ]));

        return $this->fresh($product);
    }

    public function destroy(Product $product)
    {
        $photos = $product->photos()->get();
        $product->delete();
        foreach ($photos as $ph) {
            $this->images->deleteIfUnused($ph->image_key, $ph->image_original);
        }

        return response()->noContent();
    }

    // ---- Photos ------------------------------------------------------------

    public function addPhoto(Request $request, Product $product)
    {
        $data = $request->validate(['image' => ['required', ...self::IMAGE_RULES], ...$this->cropRules('')]);
        $attrs = $this->make($request->file('image'), $this->crop($data), $data['theme'] ?? null, 'image');
        $product->photos()->create([...$attrs, 'sort' => (int) $product->photos()->max('sort') + 1]);

        return response()->json($this->fresh($product), 201);
    }

    /** Change a photo's crop and/or its light/dark label. */
    public function updatePhoto(Request $request, Product $product, ProductPhoto $photo)
    {
        $data = $request->validate($this->cropRules(''));
        $old = $photo->only('image_key', 'image_original');

        if ($crop = $this->crop($data)) {
            try {
                $photo->fill(ProductPhoto::fromStored($this->images->recrop($photo->image_original, $crop)));
            } catch (RuntimeException $e) {
                throw ValidationException::withMessages(['crop' => $e->getMessage()]);
            }
        }
        if (isset($data['theme'])) {
            $photo->theme = $data['theme'];
        }
        $photo->save();

        if ($old['image_key'] !== $photo->image_key) {
            $this->images->deleteIfUnused($old['image_key']);
        }

        return $this->fresh($product);
    }

    public function deletePhoto(Product $product, ProductPhoto $photo)
    {
        if ($product->photos()->count() <= 1) {
            throw ValidationException::withMessages(['photo' => 'A product needs at least one photo. Add another before deleting this one.']);
        }
        $photo->delete();
        $this->images->deleteIfUnused($photo->image_key, $photo->image_original);

        return $this->fresh($product);
    }

    /** New photo order; the first id becomes the cover. */
    public function orderPhotos(Request $request, Product $product)
    {
        $ids = $product->photos()->pluck('id')->all();
        $data = $request->validate([
            'ids' => ['required', 'array', 'size:'.count($ids)],
            'ids.*' => ['integer', 'distinct', Rule::in($ids)],
        ]);
        DB::transaction(function () use ($data) {
            foreach ($data['ids'] as $sort => $id) {
                ProductPhoto::whereKey($id)->update(['sort' => $sort]);
            }
        });
        Product::forgetCatalogue();

        return $this->fresh($product);
    }

    // ---- Helpers -------------------------------------------------------------

    private function detailRules(): array
    {
        return [
            'category_id' => ['required', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:160'],
            'price' => ['required', 'integer', 'min:1', 'max:10000000'],
            'was_price' => ['required', 'integer', 'gte:price', 'max:10000000'],
            // Pieces in stock; empty = not tracked (no limit).
            'stock' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'sort' => ['nullable', 'integer', 'min:0', 'max:65535'],
            'is_active' => ['nullable', 'boolean'],
            // Photo types shown in the shop; empty follows the shop setting.
            'themes' => ['nullable', 'array'],
            'themes.*' => ['distinct', Rule::in(ProductPhoto::THEMES)],
        ];
    }

    private function cropRules(string $prefix): array
    {
        return [
            "{$prefix}crop" => ['nullable', 'array'],
            "{$prefix}crop.x" => ["required_with:{$prefix}crop", 'numeric', 'between:0,1'],
            "{$prefix}crop.y" => ["required_with:{$prefix}crop", 'numeric', 'between:0,1'],
            "{$prefix}crop.size" => ["required_with:{$prefix}crop", 'numeric', 'gt:0', 'max:1'],
            "{$prefix}theme" => ['nullable', Rule::in(ProductPhoto::THEMES)],
        ];
    }

    private function details(array $data, Request $request): array
    {
        return [
            'category_id' => $data['category_id'],
            'name' => $data['name'],
            'note' => $data['note'] ?? '',
            'price' => $data['price'],
            'was_price' => $data['was_price'],
            'stock' => $data['stock'] ?? null,
            'sort' => $data['sort'] ?? 0,
            'is_active' => $request->boolean('is_active', true),
            // None chosen = follow the shop setting.
            'themes' => array_values(array_intersect(ProductPhoto::THEMES, $data['themes'] ?? [])) ?: null,
        ];
    }

    private function crop(array $data): ?array
    {
        return empty($data['crop']) ? null : array_map('floatval', $data['crop']);
    }

    /** Make the image files for an upload; the light/dark label is detected unless given. */
    private function make(UploadedFile $file, ?array $crop, ?string $theme, string $field): array
    {
        try {
            $stored = $this->images->store($file->getRealPath(), $crop);
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages([$field => $e->getMessage()]);
        }

        return [...ProductPhoto::fromStored($stored), 'theme' => $theme ?? $stored['theme']];
    }

    private function fresh(Product $product): array
    {
        return $product->fresh(['category', 'photos'])->toAdmin();
    }
}
