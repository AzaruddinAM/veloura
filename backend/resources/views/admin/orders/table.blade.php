<table>
  <tr><th>Ref</th><th>Date</th><th>Customer</th><th>Pieces</th><th>Total</th><th>Status</th></tr>
  @forelse ($orders as $o)
    <tr>
      <td><a href="{{ route('admin.orders.show', $o) }}">{{ $o->ref }}</a></td>
      <td>{{ $o->created_at->timezone(config('app.display_timezone'))->format('d M Y, h:i A') }}</td>
      <td>{{ $o->customer_name ?: '—' }} <span class="muted">{{ $o->phone }}</span></td>
      <td>{{ $o->items_count }}</td>
      <td>₹{{ number_format($o->total) }}</td>
      <td><span class="pill {{ $o->status }}">{{ ucfirst($o->status) }}</span></td>
    </tr>
  @empty
    <tr><td colspan="6" class="muted">No orders yet.</td></tr>
  @endforelse
</table>
