<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enquiry;
use Illuminate\Http\Request;

class EnquiryController extends Controller
{
    public function index(Request $request)
    {
        $page = Enquiry::with('order:id,ref,total')
            ->when($request->boolean('unread'), fn ($q) => $q->where('is_read', false))
            ->latest()
            ->paginate(20);

        return [
            'data' => $page->getCollection()->map(fn (Enquiry $e) => [
                'id' => $e->id,
                'name' => $e->name,
                'phone' => $e->phone,
                'message' => $e->message,
                'is_read' => $e->is_read,
                'order' => $e->order ? ['id' => $e->order->id, 'ref' => $e->order->ref, 'total' => $e->order->total] : null,
                'created_at' => $e->created_at->toIso8601String(),
            ]),
            'meta' => ['page' => $page->currentPage(), 'pages' => $page->lastPage(), 'total' => $page->total()],
        ];
    }

    public function update(Request $request, Enquiry $enquiry)
    {
        $enquiry->update($request->validate(['is_read' => ['required', 'boolean']]));

        return response()->noContent();
    }

    public function destroy(Enquiry $enquiry)
    {
        $enquiry->delete();

        return response()->noContent();
    }
}
