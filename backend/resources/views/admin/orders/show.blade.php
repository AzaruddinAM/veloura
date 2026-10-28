@extends('admin.layout')
@section('title', $order->ref)
@section('content')
<p><a href="{{ route('admin.orders.index') }}">← All orders</a></p>
<h1>Order {{ $order->ref }} <span class="pill {{ $order->status }}">{{ ucfirst($order->status) }}</span></h1>
<p class="muted">Placed {{ $order->created_at->timezone(config('app.display_timezone'))->format('d M Y, h:i A') }} via {{ $order->channel }}.</p>

<table style="margin-bottom:1.5rem">
  <tr><th>Piece</th><th>Price</th><th>Qty</th><th>Line total</th></tr>
  @foreach ($order->items as $item)
    <tr><td>{{ $item->name }}</td><td>₹{{ number_format($item->price) }}</td><td>{{ $item->qty }}</td><td>₹{{ number_format($item->line_total) }}</td></tr>
  @endforeach
  <tr><th colspan="3">Total</th><th>₹{{ number_format($order->total) }}</th></tr>
</table>

<form method="post" action="{{ route('admin.orders.update', $order) }}" class="card">
  @csrf @method('PATCH')
  <p class="muted" style="margin-top:0">The customer sends their details on WhatsApp. Copy them here to keep a record.</p>
  <div class="grid2">
    <label>Status
      <select name="status">
        @foreach (\App\Models\Order::STATUSES as $s)
          <option value="{{ $s }}" @selected(old('status', $order->status) === $s)>{{ ucfirst($s) }}</option>
        @endforeach
      </select>
    </label>
    <label>Customer name <input name="customer_name" value="{{ old('customer_name', $order->customer_name) }}"></label>
    <label>Phone <input name="phone" value="{{ old('phone', $order->phone) }}"></label>
    <label>Delivery address <input name="address" value="{{ old('address', $order->address) }}"></label>
  </div>
  <label>Notes <textarea name="note" rows="3">{{ old('note', $order->note) }}</textarea></label>
  <button>Save order</button>
</form>
@endsection
