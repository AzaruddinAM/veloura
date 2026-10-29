<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

#[Fillable(['ref', 'customer_name', 'phone', 'address', 'note', 'total', 'status', 'channel', 'ip'])]
class Order extends Model
{
    public const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

    /** Validation rules for a bag sent from the site. */
    public const BAG_RULES = [
        'ref' => ['string', 'regex:/^VL-[A-Z0-9]{6,14}$/', 'unique:orders,ref'],
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
     * Save a bag as an order. Prices and the total always come from the
     * database, never from the browser.
     *
     * @param  list<array{id: int, qty: int}>  $items
     */
    public static function place(string $ref, array $items, array $attrs = []): self
    {
        $products = Product::where('is_active', true)
            ->whereIn('id', array_column($items, 'id'))
            ->get()
            ->keyBy('id');

        $lines = [];
        foreach ($items as $i => $item) {
            $p = $products->get($item['id']);
            if (! $p) {
                throw ValidationException::withMessages(["items.$i.id" => 'This piece is no longer available.']);
            }
            $lines[] = [
                'product_id' => $p->id,
                'name' => $p->name,
                'price' => $p->price,
                'qty' => $item['qty'],
                'line_total' => $p->price * $item['qty'],
            ];
        }

        return DB::transaction(function () use ($ref, $lines, $attrs) {
            $order = self::create([
                ...$attrs,
                'ref' => $ref,
                'total' => array_sum(array_column($lines, 'line_total')),
            ]);
            $order->items()->createMany($lines);

            return $order;
        });
    }
}
