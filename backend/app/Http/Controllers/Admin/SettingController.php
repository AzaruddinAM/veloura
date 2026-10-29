<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SettingController extends Controller
{
    public function show()
    {
        return Setting::values();
    }

    public function update(Request $request)
    {
        $data = $request->validate(collect(Setting::OPTIONS)
            ->map(fn ($allowed) => ['sometimes', 'required', Rule::in($allowed)])
            ->all());

        foreach ($data as $key => $value) {
            Setting::put($key, $value);
        }

        return Setting::values();
    }
}
