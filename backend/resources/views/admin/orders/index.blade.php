@extends('admin.layout')
@section('title', 'Orders')
@section('content')
<h1>Orders</h1>
<div class="row" style="margin-bottom:1rem">
  <a class="btn {{ $status ? 'line' : '' }}" href="{{ route('admin.orders.index') }}">All</a>
  @foreach (\App\Models\Order::STATUSES as $s)
    <a class="btn {{ $status === $s ? '' : 'line' }}" href="{{ route('admin.orders.index', ['status' => $s]) }}">{{ ucfirst($s) }}</a>
  @endforeach
</div>
@include('admin.orders.table')
<nav class="pages">{{ $orders->links('pagination::simple-bootstrap-5') }}</nav>
@endsection
