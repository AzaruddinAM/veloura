<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Enquiry;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EnquiryController extends Controller
{
    /**
     * Save a contact-form message. If the customer had pieces in their bag, the
     * site sends them too and they are saved as an order with the customer's
     * name and phone, linked to this message.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'phone' => ['required', 'string', 'regex:/^[+]?[0-9 ]{10,14}$/'],
            'message' => ['required', 'string', 'min:5', 'max:2000'],
            'ref' => ['required_with:items', ...Order::BAG_RULES['ref']],
            'items' => ['nullable', ...Order::BAG_RULES['items']],
            'items.*.id' => Order::BAG_RULES['items.*.id'],
            'items.*.qty' => Order::BAG_RULES['items.*.qty'],
        ]);

        $enquiry = DB::transaction(function () use ($data, $request) {
            $order = empty($data['items']) ? null : Order::place($data['ref'], $data['items'], [
                'customer_name' => $data['name'],
                'phone' => $data['phone'],
                'note' => $data['message'],
                'channel' => 'contact form',
                'ip' => $request->ip(),
            ]);

            return Enquiry::create([
                'name' => $data['name'],
                'phone' => $data['phone'],
                'message' => $data['message'],
                'order_id' => $order?->id,
                'ip' => $request->ip(),
            ]);
        });

        return response()->json(['id' => $enquiry->id, 'ref' => $enquiry->order?->ref], 201);
    }
}
