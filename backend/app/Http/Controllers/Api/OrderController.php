<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    /**
     * Record a bag that the customer is sending to WhatsApp. The site makes up
     * the reference so it can put it in the WhatsApp message straight away.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'ref' => ['required', ...Order::BAG_RULES['ref']],
            'items' => ['required', ...Order::BAG_RULES['items']],
            'items.*.id' => Order::BAG_RULES['items.*.id'],
            'items.*.qty' => Order::BAG_RULES['items.*.qty'],
            'name' => ['nullable', 'string', 'max:80'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $order = Order::place($data['ref'], $data['items'], [
            'customer_name' => $data['name'] ?? null,
            'phone' => $data['phone'] ?? null,
            'ip' => $request->ip(),
        ]);

        return response()->json(['ref' => $order->ref, 'total' => $order->total], 201);
    }
}
