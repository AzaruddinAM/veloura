@extends('admin.layout')
@section('title', 'Categories')
@section('content')
<h1>Categories</h1>
<p class="muted">These become the filter chips above the collection. Lower order shows first; a category with no products on sale is hidden.</p>
<table style="margin-bottom:1.5rem">
  <tr><th>Name</th><th>Order</th><th>Products</th><th></th></tr>
  @foreach ($categories as $c)
    <tr>
      <td colspan="2">
        <form method="post" action="{{ route('admin.categories.update', $c) }}" class="row" id="cat{{ $c->id }}">
          @csrf @method('PATCH')
          <input name="name" value="{{ $c->name }}" required style="max-width:240px">
          <input type="number" name="sort" value="{{ $c->sort }}" min="0" style="max-width:90px">
          <button class="line">Save</button>
        </form>
      </td>
      <td>{{ $c->products_count }}</td>
      <td>
        <form method="post" action="{{ route('admin.categories.destroy', $c) }}" onsubmit="return confirm('Delete this category?')">
          @csrf @method('DELETE')<button class="danger">Delete</button>
        </form>
      </td>
    </tr>
  @endforeach
</table>
<form method="post" action="{{ route('admin.categories.store') }}" class="card row">
  @csrf
  <input name="name" placeholder="New category name" required style="max-width:260px">
  <input type="number" name="sort" placeholder="Order" min="0" style="max-width:100px">
  <button>Add category</button>
</form>
@endsection
