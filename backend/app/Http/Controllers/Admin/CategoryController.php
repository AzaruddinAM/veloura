<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CategoryController extends Controller
{
    public function index()
    {
        return Category::withCount('products')->orderBy('sort')->orderBy('name')->get(['id', 'name', 'sort']);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60', 'unique:categories,name'],
            'sort' => ['nullable', 'integer', 'min:0', 'max:65535'],
        ]);

        return response()->json(Category::create(['name' => $data['name'], 'sort' => $data['sort'] ?? 0]), 201);
    }

    public function update(Request $request, Category $category)
    {
        $category->update($request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique('categories')->ignore($category)],
            'sort' => ['required', 'integer', 'min:0', 'max:65535'],
        ]));

        return $category;
    }

    public function destroy(Category $category)
    {
        if ($category->products()->exists()) {
            throw ValidationException::withMessages(['name' => 'Move or delete the products in this category first.']);
        }
        $category->delete();

        return response()->noContent();
    }
}
