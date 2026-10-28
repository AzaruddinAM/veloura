<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enquiry;
use App\Models\Order;
use App\Models\Product;

class DashboardController extends Controller
{
    public function __invoke()
    {
        return view('admin.dashboard', [
            'pendingOrders' => Order::where('status', 'pending')->count(),
            'ordersToday' => Order::whereDate('created_at', today())->count(),
            'unreadEnquiries' => Enquiry::where('is_read', false)->count(),
            'activeProducts' => Product::where('is_active', true)->count(),
            'latestOrders' => Order::withCount('items')->latest()->limit(8)->get(),
        ]);
    }
}
