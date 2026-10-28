<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Enquiry;
use Illuminate\Http\Request;

class EnquiryController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'phone' => ['required', 'string', 'regex:/^[+]?[0-9 ]{10,14}$/'],
            'message' => ['required', 'string', 'min:5', 'max:2000'],
        ]);

        $enquiry = Enquiry::create([...$data, 'ip' => $request->ip()]);

        return response()->json(['id' => $enquiry->id], 201);
    }
}
