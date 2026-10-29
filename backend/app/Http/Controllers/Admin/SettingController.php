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
        $rules = [];
        foreach (Setting::OPTIONS as $key => $allowed) {
            if (Setting::isSingle($key)) {
                $rules[$key] = ['sometimes', 'required', 'string', Rule::in($allowed)];
                continue;
            }
            $rules[$key] = ['sometimes', 'required', 'array', 'min:1'];
            $rules["{$key}.*"] = ['distinct', Rule::in($allowed)];
        }
        $data = $request->validate($rules, [
            'photo_themes.required' => 'Choose at least one photo type.',
            'photo_themes.min' => 'Choose at least one photo type.',
        ]);

        foreach ($data as $key => $values) {
            Setting::put($key, $values);
        }

        return Setting::values();
    }
}
