@extends('admin.layout')
@section('title', 'Log in')
@section('content')
<form method="post" action="{{ route('admin.login') }}" class="card" style="max-width:380px;margin:10vh auto">
  @csrf
  <h1>Veloura admin</h1>
  <label>Email <input type="email" name="email" value="{{ old('email') }}" required autofocus autocomplete="username"></label>
  <label>Password <input type="password" name="password" required autocomplete="current-password"></label>
  <label class="check"><input type="checkbox" name="remember" value="1"> Keep me logged in</label>
  <button>Log in</button>
</form>
@endsection
