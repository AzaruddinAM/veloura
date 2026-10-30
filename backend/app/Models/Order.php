<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

#[Fillable(['ref', 'customer_name', 'phone', 'address', 'note', 'total', 'status', 'channel', 'ip'])]
class Order extends Model
{
    public const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

    /** Statuses whose pieces have not left the shop yet (deleting such an order returns them to stock). */
    public const NOT_SENT = ['pending', 'confirmed'];

    /** Validation rules for a bag sent from the site. */
    public const BAG_RULES = [
        // Optional: older versions of the site sent their own reference. New orders get one from the server.
        'ref' => ['nullable', 'string', 'regex:/^VL-[A-Z0-9]{6,14}$/', 'unique:orders,ref'],
        'items' => ['array', 'min:1', 'max:50'],
        'items.*.id' => ['required', 'integer', 'distinct'],
        'items.*.qty' => ['required', 'integer', 'min:1', 'max:99'],
    ];

    protected function casts(): array
    {
        return ['total' => 'integer'];
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * Save a bag as an order. Prices and the total always come from the database,
     * never from the browser. Each piece must be on sale and in stock; the pieces
     * are taken out of stock in the same transaction, with the product rows locked,
     * so two customers cannot both buy the last piece.
     *
     * @param  list<array{id: int, qty: int}>  $items
     */
    public static function place(?string $ref, array $items, array $attrs = []): self
    {
        return DB::transaction(function () use ($ref, $items, $attrs) {
            $products = Product::where('is_active', true)
                ->whereIn('id', array_column($items, 'id'))
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $lines = [];
            foreach ($items as $i => $item) {
                $p = $products->get($item['id']);
                if (! $p) {
                    throw ValidationException::withMessages(["items.$i.id" => 'This piece is no longer available.']);
                }
                self::checkStock($p, $item['qty'], "items.$i.qty");
                $lines[] = [
                    'product_id' => $p->id,
                    'name' => $p->name,
                    'price' => $p->price,
                    'qty' => $item['qty'],
                    'line_total' => $p->price * $item['qty'],
                ];
            }

            foreach ($items as $item) {
                $products->get($item['id'])->takeStock($item['qty']);
            }

            $order = self::create([
                ...$attrs,
                'ref' => $ref ?? self::newRef(),
                'total' => array_sum(array_column($lines, 'line_total')),
            ]);
            $order->items()->createMany($lines);

            return $order;
        });
    }

    /** Put this order's pieces back into stock (e.g. when it is cancelled). */
    public function releaseStock(): void
    {
        DB::transaction(function () {
            foreach ($this->items()->whereNotNull('product_id')->get() as $item) {
                Product::whereKey($item->product_id)->lockForUpdate()->first()?->returnStock($item->qty);
            }
        });
    }

    /** Take this order's pieces out of stock again (e.g. when a cancelled order is re-opened). */
    public function reserveStock(): void
    {
        DB::transaction(function () {
            $items = $this->items()->whereNotNull('product_id')->get();
            $products = Product::whereIn('id', $items->pluck('product_id'))->lockForUpdate()->get()->keyBy('id');
            foreach ($items as $item) {
                if ($p = $products->get($item->product_id)) {
                    self::checkStock($p, $item->qty, 'status');
                }
            }
            foreach ($items as $item) {
                $products->get($item->product_id)?->takeStock($item->qty);
            }
        });
    }

    private static function checkStock(Product $p, int $qty, string $field): void
    {
        if ($p->stock !== null && $qty > $p->stock) {
            throw ValidationException::withMessages([
                $field => $p->stock === 0 ? "{$p->name} is sold out." : "Only {$p->stock} left of {$p->name}.",
            ]);
        }
    }

    /** A new unique reference like VL-7KQ2M9XA. */
    private static function newRef(): string
    {
        do {
            $ref = 'VL-'.Str::upper(Str::random(8));
        } while (! preg_match('/^VL-[A-Z0-9]{8}$/', $ref) || self::where('ref', $ref)->exists());

        return $ref;
    }
}
