@extends('admin.layout')
@section('title', $product->exists ? 'Edit product' : 'Add product')
@section('content')
<p><a href="{{ route('admin.products.index') }}">← All products</a></p>
<h1>{{ $product->exists ? 'Edit '.$product->name : 'Add product' }}</h1>
<form method="post" enctype="multipart/form-data" class="card"
      action="{{ $product->exists ? route('admin.products.update', $product) : route('admin.products.store') }}">
  @csrf
  @if ($product->exists) @method('PUT') @endif
  <div class="grid2">
    <label>Name <input name="name" value="{{ old('name', $product->name) }}" required maxlength="120"></label>
    <label>Category
      <select name="category_id" required>
        @foreach ($categories as $c)
          <option value="{{ $c->id }}" @selected(old('category_id', $product->category_id) == $c->id)>{{ $c->name }}</option>
        @endforeach
      </select>
    </label>
    <label>Selling price (₹) <input type="number" name="price" min="1" value="{{ old('price', $product->price) }}" required></label>
    <label>Original price / MRP (₹) <input type="number" name="was_price" min="1" value="{{ old('was_price', $product->was_price) }}" required></label>
    <label>Short note <input name="note" value="{{ old('note', $product->note) }}" maxlength="160" placeholder="e.g. Pendant and studs"></label>
    <label>Display order (lower shows first) <input type="number" name="sort" min="0" value="{{ old('sort', $product->sort ?? 0) }}"></label>
  </div>
  <label>Photo {{ $product->exists ? '(leave empty to keep the current one)' : '' }}
    <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" @required(! $product->exists)>
    <span class="muted" style="font-size:.85rem">Any JPG, PNG or WebP. It is cropped to the centre square and saved as small WebP files automatically. Max 8 MB.</span>
  </label>
  @if ($product->image_key)
    <img src="{{ $product->imageSet()['img'] }}" alt="" width="160" height="160" style="border-radius:8px;margin-bottom:1rem">
  @endif
  <label class="check"><input type="checkbox" name="is_active" value="1" @checked(old('is_active', $product->is_active))> Show on the website</label>
  <button>{{ $product->exists ? 'Save changes' : 'Add product' }}</button>
</form>
@endsection
