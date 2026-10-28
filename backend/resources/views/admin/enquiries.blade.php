@extends('admin.layout')
@section('title', 'Enquiries')
@section('content')
<h1>Enquiries</h1>
<table>
  <tr><th>Date</th><th>Name</th><th>Phone</th><th>Message</th><th></th></tr>
  @forelse ($enquiries as $e)
    <tr @class(['muted' => $e->is_read])>
      <td>{{ $e->created_at->timezone(config('app.display_timezone'))->format('d M, h:i A') }}</td>
      <td>{{ $e->name }}</td>
      <td><a href="https://wa.me/{{ preg_replace('/\D/', '', $e->phone) }}" target="_blank" rel="noopener">{{ $e->phone }}</a></td>
      <td style="white-space:pre-line">{{ $e->message }}</td>
      <td>
        <form method="post" action="{{ route('admin.enquiries.update', $e) }}">
          @csrf @method('PATCH')
          <input type="hidden" name="is_read" value="{{ $e->is_read ? 0 : 1 }}">
          <button class="line">{{ $e->is_read ? 'Mark unread' : 'Mark read' }}</button>
        </form>
      </td>
    </tr>
  @empty
    <tr><td colspan="5" class="muted">No enquiries yet.</td></tr>
  @endforelse
</table>
<nav class="pages">{{ $enquiries->links('pagination::simple-bootstrap-5') }}</nav>
@endsection
