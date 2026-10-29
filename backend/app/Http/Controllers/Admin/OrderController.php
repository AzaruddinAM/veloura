<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enquiry;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->query('status');
        $q = trim((string) $request->query('q'));

        $page = Order::withCount('items')
            ->when(in_array($status, Order::STATUSES, true), fn ($query) => $query->where('status', $status))
            ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w
                ->where('ref', 'like', "%{$q}%")
                ->orWhere('customer_name', 'like', "%{$q}%")
                ->orWhere('phone', 'like', "%{$q}%")))
            ->latest()
            ->paginate(20);

        return [
            'data' => $page->getCollection()->map(fn (Order $o) => self::row($o)),
            'meta' => ['page' => $page->currentPage(), 'pages' => $page->lastPage(), 'total' => $page->total()],
            'counts' => Order::selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status'),
        ];
    }

    public function show(Order $order)
    {
        $order->load('items.product.photos');

        return [
            ...self::row($order),
            'address' => $order->address,
            'note' => $order->note,
            'channel' => $order->channel,
            'items' => $order->items->map(fn (OrderItem $i) => [
                'name' => $i->name,
                'price' => $i->price,
                'qty' => $i->qty,
                'line_total' => $i->line_total,
                'thumb' => $i->product?->imageSet()['thumb'],
            ]),
            'enquiry' => Enquiry::where('order_id', $order->id)->first(['id', 'message']),
        ];
    }

    public function update(Request $request, Order $order)
    {
        $order->update($request->validate([
            'status' => ['sometimes', 'required', Rule::in(Order::STATUSES)],
            'customer_name' => ['sometimes', 'nullable', 'string', 'max:80'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'address' => ['sometimes', 'nullable', 'string', 'max:500'],
            'note' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]));

        return $this->show($order);
    }

    public function destroy(Order $order)
    {
        $order->delete();

        return response()->noContent();
    }

    public static function row(Order $o): array
    {
        return [
            'id' => $o->id,
            'ref' => $o->ref,
            'customer_name' => $o->customer_name,
            'phone' => $o->phone,
            'total' => $o->total,
            'status' => $o->status,
            'items_count' => $o->items_count ?? $o->items()->count(),
            'created_at' => $o->created_at->toIso8601String(),
        ];
    }
}
