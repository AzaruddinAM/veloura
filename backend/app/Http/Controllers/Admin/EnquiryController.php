<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enquiry;
use Illuminate\Http\Request;

class EnquiryController extends Controller
{
    public function index()
    {
        return view('admin.enquiries', ['enquiries' => Enquiry::orderBy('is_read')->latest()->paginate(30)]);
    }

    public function update(Request $request, Enquiry $enquiry)
    {
        $enquiry->update(['is_read' => $request->boolean('is_read')]);

        return back();
    }
}
