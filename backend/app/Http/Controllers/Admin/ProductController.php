<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Support\ProductImage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ProductController extends Controller
{
    public function __construct(private ProductImage $images) {}

    public function index()
    {
        return view('admin.products.index', [
            'products' => Product::with('category')->orderBy('category_id')->orderBy('sort')->orderBy('id')->get(),
        ]);
    }

    public function create()
    {
        return view('admin.products.form', ['product' => new Product(['is_active' => true]), 'categories' => Category::orderBy('sort')->get()]);
    }

    public function store(Request $request)
    {
        $product = new Product($this->validated($request, true));
        $this->saveWithImage($request, $product);

        return redirect()->route('admin.products.index')->with('ok', "Added {$product->name}.");
    }

    public function edit(Product $product)
    {
        return view('admin.products.form', ['product' => $product, 'categories' => Category::orderBy('sort')->get()]);
    }

    public function update(Request $request, Product $product)
    {
        $product->fill($this->validated($request, false));
        $this->saveWithImage($request, $product);

        return redirect()->route('admin.products.index')->with('ok', "Saved {$product->name}.");
    }

    public function destroy(Product $product)
    {
        $key = $product->image_key;
        $product->delete();
        $this->images->deleteIfUnused($key);

        return redirect()->route('admin.products.index')->with('ok', "Deleted {$product->name}.");
    }

    private function validated(Request $request, bool $creating): array
    {
        $data = $request->validate([
            'category_id' => ['required', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:160'],
            'price' => ['required', 'integer', 'min:1', 'max:10000000'],
            'was_price' => ['required', 'integer', 'gte:price', 'max:10000000'],
            'sort' => ['nullable', 'integer', 'min:0', 'max:65535'],
            'image' => [$creating ? 'required' : 'nullable', 'file', 'mimes:jpg,jpeg,png,webp,avif,gif', 'max:8192'],
        ]);

        return [
            ...collect($data)->except('image')->all(),
            'note' => $data['note'] ?? '',
            'sort' => $data['sort'] ?? 0,
            'is_active' => $request->boolean('is_active'),
        ];
    }

    private function saveWithImage(Request $request, Product $product): void
    {
        $oldKey = $product->getOriginal('image_key');

        if ($file = $request->file('image')) {
            try {
                $img = $this->images->store($file->getRealPath());
            } catch (RuntimeException $e) {
                throw ValidationException::withMessages(['image' => $e->getMessage()]);
            }
            $product->image_key = $img['key'];
            $product->image_sizes = $img['sizes'];
        }

        DB::transaction(fn () => $product->save());

        if ($oldKey !== $product->image_key) {
            $this->images->deleteIfUnused($oldKey);
        }
    }
}
