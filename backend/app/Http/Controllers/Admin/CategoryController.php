<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index()
    {
        return view('admin.categories', ['categories' => Category::withCount('products')->orderBy('sort')->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60', 'unique:categories,name'],
            'sort' => ['nullable', 'integer', 'min:0', 'max:65535'],
        ]);
        Category::create(['name' => $data['name'], 'sort' => $data['sort'] ?? 0]);

        return back()->with('ok', 'Category added.');
    }

    public function update(Request $request, Category $category)
    {
        $category->update($request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique('categories')->ignore($category)],
            'sort' => ['required', 'integer', 'min:0', 'max:65535'],
        ]));

        return back()->with('ok', 'Category saved.');
    }

    public function destroy(Category $category)
    {
        if ($category->products()->exists()) {
            return back()->withErrors(['name' => 'Move or delete the products in this category first.']);
        }
        $category->delete();

        return back()->with('ok', 'Category deleted.');
    }
}
