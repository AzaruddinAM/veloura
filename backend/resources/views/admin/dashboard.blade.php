@extends('admin.layout')
@section('title', 'Dashboard')
@section('content')
<h1>Dashboard</h1>
<div class="stats">
  <a class="card" href="{{ route('admin.orders.index', ['status' => 'pending']) }}" style="text-decoration:none;color:inherit"><b>{{ $pendingOrders }}</b>Pending orders</a>
  <div class="card"><b>{{ $ordersToday }}</b>Orders today</div>
  <a class="card" href="{{ route('admin.enquiries.index') }}" style="text-decoration:none;color:inherit"><b>{{ $unreadEnquiries }}</b>Unread enquiries</a>
  <a class="card" href="{{ route('admin.products.index') }}" style="text-decoration:none;color:inherit"><b>{{ $activeProducts }}</b>Products on sale</a>
</div>
<h2 style="font-weight:500">Latest orders</h2>
@include('admin.orders.table', ['orders' => $latestOrders])
@endsection
