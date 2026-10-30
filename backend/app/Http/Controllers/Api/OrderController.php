<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    /**
     * Save the customer's bag as an order, before the site opens WhatsApp.
     * Fails (422) when a piece is no longer on sale or not enough is in stock;
     * on success the answer has the reference and the confirmed lines, which the
     * site puts in the WhatsApp message.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'ref' => Order::BAG_RULES['ref'],
            'items' => ['required', ...Order::BAG_RULES['items']],
            'items.*.id' => Order::BAG_RULES['items.*.id'],
            'items.*.qty' => Order::BAG_RULES['items.*.qty'],
            'name' => ['nullable', 'string', 'max:80'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $order = Order::place($data['ref'] ?? null, $data['items'], [
            'customer_name' => $data['name'] ?? null,
            'phone' => $data['phone'] ?? null,
            'ip' => $request->ip(),
        ]);

        return response()->json(self::summary($order), 201);
    }

    /** Reference, confirmed lines and total, as sent back to the site. */
    public static function summary(Order $order): array
    {
        return [
            'ref' => $order->ref,
            'total' => $order->total,
            'items' => $order->items->map(fn (OrderItem $i) => [
                'id' => $i->product_id,
                'name' => $i->name,
                'price' => $i->price,
                'qty' => $i->qty,
                'line_total' => $i->line_total,
            ])->values(),
        ];
    }
}
