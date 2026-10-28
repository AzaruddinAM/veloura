<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->query('status');

        return view('admin.orders.index', [
            'status' => $status,
            'orders' => Order::withCount('items')
                ->when(in_array($status, Order::STATUSES, true), fn ($q) => $q->where('status', $status))
                ->latest()
                ->paginate(30)
                ->withQueryString(),
        ]);
    }

    public function show(Order $order)
    {
        return view('admin.orders.show', ['order' => $order->load('items')]);
    }

    public function update(Request $request, Order $order)
    {
        $order->update($request->validate([
            'status' => ['required', Rule::in(Order::STATUSES)],
            'customer_name' => ['nullable', 'string', 'max:80'],
            'phone' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string', 'max:500'],
            'note' => ['nullable', 'string', 'max:500'],
        ]));

        return back()->with('ok', "Order {$order->ref} saved.");
    }
}
