<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enquiry;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    /** Order statuses that count as a sale. */
    private const SOLD = ['confirmed', 'shipped', 'delivered'];

    /** Small numbers for the sidebar badges, polled by the admin panel. */
    public function counts()
    {
        return [
            'pending_orders' => Order::where('status', 'pending')->count(),
            'unread_enquiries' => Enquiry::where('is_read', false)->count(),
        ];
    }

    public function __invoke()
    {
        $tz = config('app.display_timezone');
        $now = Carbon::now($tz);
        $today = $now->copy()->startOfDay()->utc();
        $month = $now->copy()->startOfMonth()->utc();
        $since = $now->copy()->subDays(13)->startOfDay();

        // Last 14 days, grouped in PHP so it works the same on MySQL and SQLite.
        $recent = Order::where('created_at', '>=', $since->copy()->utc())
            ->where('status', '!=', 'cancelled')
            ->get(['created_at', 'total'])
            ->groupBy(fn (Order $o) => $o->created_at->timezone($tz)->toDateString());
        $days = collect(range(0, 13))->map(function ($i) use ($since, $recent) {
            $day = $since->copy()->addDays($i);
            $orders = $recent->get($day->toDateString(), collect());

            return ['date' => $day->toDateString(), 'label' => $day->format('d M'), 'orders' => $orders->count(), 'total' => (int) $orders->sum('total')];
        });

        $top = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', '!=', 'cancelled')
            ->where('orders.created_at', '>=', $now->copy()->subDays(90)->utc())
            ->selectRaw('order_items.name, SUM(order_items.qty) as qty, SUM(order_items.line_total) as total')
            ->groupBy('order_items.name')
            ->orderByDesc('qty')
            ->limit(5)
            ->get()
            ->map(fn ($r) => ['name' => $r->name, 'qty' => (int) $r->qty, 'total' => (int) $r->total]);

        return [
            'stats' => [
                'pending_orders' => Order::where('status', 'pending')->count(),
                'orders_today' => Order::where('created_at', '>=', $today)->count(),
                'orders_month' => Order::where('created_at', '>=', $month)->where('status', '!=', 'cancelled')->count(),
                'sales_month' => (int) Order::where('created_at', '>=', $month)->whereIn('status', self::SOLD)->sum('total'),
                'unread_enquiries' => Enquiry::where('is_read', false)->count(),
                'active_products' => Product::where('is_active', true)->count(),
                'hidden_products' => Product::where('is_active', false)->count(),
                // Products on sale with 3 pieces or fewer left (stock tracked).
                'low_stock' => Product::where('is_active', true)->whereNotNull('stock')->where('stock', '<=', Product::LOW_STOCK)->count(),
            ],
            'days' => $days,
            'top_products' => $top,
            'latest_orders' => Order::withCount('items')->latest()->limit(6)->get()->map(fn (Order $o) => OrderController::row($o)),
        ];
    }
}
