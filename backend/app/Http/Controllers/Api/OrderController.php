<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    /**
     * Record a bag that the customer is sending to WhatsApp. The site makes up
     * the reference so it can put it in the WhatsApp message straight away;
     * prices and the total are always taken from the database, never the browser.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'ref' => ['required', 'string', 'regex:/^VL-[A-Z0-9]{6,14}$/', 'unique:orders,ref'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.id' => ['required', 'integer', 'distinct'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:99'],
            'name' => ['nullable', 'string', 'max:80'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $products = Product::where('is_active', true)
            ->whereIn('id', array_column($data['items'], 'id'))
            ->get()
            ->keyBy('id');

        $lines = [];
        foreach ($data['items'] as $i => $item) {
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

        $order = DB::transaction(function () use ($data, $lines, $request) {
            $order = Order::create([
                'ref' => $data['ref'],
                'customer_name' => $data['name'] ?? null,
                'phone' => $data['phone'] ?? null,
                'total' => array_sum(array_column($lines, 'line_total')),
                'ip' => $request->ip(),
            ]);
            $order->items()->createMany($lines);

            return $order;
        });

        return response()->json(['ref' => $order->ref, 'total' => $order->total], 201);
    }
}
