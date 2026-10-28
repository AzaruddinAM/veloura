@extends('admin.layout')
@section('title', 'Products')
@section('content')
<div class="row" style="justify-content:space-between"><h1>Products</h1><a class="btn" href="{{ route('admin.products.create') }}">Add product</a></div>
<table>
  <tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>MRP</th><th>Order</th><th>On sale</th><th></th></tr>
  @forelse ($products as $p)
    <tr>
      <td>@if ($p->image_key)<img class="thumb" src="{{ $p->imageSet()['thumb'] }}" alt="" width="56" height="56" loading="lazy">@endif</td>
      <td>{{ $p->name }}<div class="muted">{{ $p->note }}</div></td>
      <td>{{ $p->category->name }}</td>
      <td>₹{{ number_format($p->price) }}</td>
      <td><s class="muted">₹{{ number_format($p->was_price) }}</s></td>
      <td>{{ $p->sort }}</td>
      <td>{{ $p->is_active ? 'Yes' : 'Hidden' }}</td>
      <td class="row">
        <a class="btn line" href="{{ route('admin.products.edit', $p) }}">Edit</a>
        <form method="post" action="{{ route('admin.products.destroy', $p) }}" onsubmit="return confirm('Delete {{ addslashes($p->name) }}?')">
          @csrf @method('DELETE')<button class="danger">Delete</button>
        </form>
      </td>
    </tr>
  @empty
    <tr><td colspan="8" class="muted">No products yet.</td></tr>
  @endforelse
</table>
@endsection
