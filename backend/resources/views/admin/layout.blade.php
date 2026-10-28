<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>@yield('title', 'Admin') · Veloura</title>
  <style>
    :root{--ink:#0b0605;--cocoa:#2b1810;--gold:#d4a95a;--gold-hi:#f3d992;--cream:#f7efe2;--muted:#cdbba3}
    *{box-sizing:border-box}
    body{margin:0;background:var(--ink);color:var(--cream);font:15px/1.5 system-ui,sans-serif}
    a{color:var(--gold-hi)}
    header{display:flex;gap:1.2rem;align-items:center;flex-wrap:wrap;padding:.8rem 1.5rem;border-bottom:1px solid #d4a95a44;background:var(--cocoa)}
    header strong{color:var(--gold);letter-spacing:.1em;margin-right:auto}
    header a{text-decoration:none;color:var(--cream)}header a.on{color:var(--gold-hi);text-decoration:underline}
    main{max-width:1150px;margin:auto;padding:1.5rem}
    h1{font-weight:500;color:var(--gold-hi);margin:.2rem 0 1.2rem}
    table{width:100%;border-collapse:collapse;background:var(--cocoa);border-radius:8px;overflow:hidden}
    th,td{padding:.6rem .8rem;text-align:left;border-bottom:1px solid #d4a95a22;vertical-align:middle}
    th{color:var(--gold);font-weight:500}
    input,select,textarea{font:inherit;color:var(--cream);background:var(--ink);border:1px solid #d4a95a55;border-radius:6px;padding:.5rem .7rem;width:100%}
    label{display:grid;gap:.25rem;color:var(--gold);margin-bottom:.9rem}
    label.check{display:flex;align-items:center;gap:.5rem}label.check input{width:auto}
    .btn,button{font:inherit;cursor:pointer;border:1px solid var(--gold);background:var(--gold);color:var(--ink);border-radius:99px;padding:.45rem 1.1rem;text-decoration:none;display:inline-block}
    .btn.line,button.line{background:none;color:var(--cream)}
    button.danger{background:none;border-color:#e07a6a;color:#ff9d8a}
    .card{background:var(--cocoa);border:1px solid #d4a95a33;border-radius:10px;padding:1.2rem}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem}
    .stats b{display:block;font-size:2rem;color:var(--gold-hi);font-weight:500}
    .row{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 1rem}
    .flash{background:#2e4a2b;border:1px solid #6fae63;padding:.6rem 1rem;border-radius:8px;margin-bottom:1rem}
    .err{background:#4a2420;border:1px solid #e07a6a;padding:.6rem 1rem;border-radius:8px;margin-bottom:1rem}
    .pill{display:inline-block;padding:.05rem .6rem;border-radius:99px;font-size:.8rem;border:1px solid var(--gold);color:var(--gold-hi)}
    .pill.pending{background:#d4a95a33}.pill.cancelled{border-color:#e07a6a;color:#ff9d8a}.pill.delivered{border-color:#6fae63;color:#a6dc9b}
    .muted{color:var(--muted)}
    img.thumb{width:56px;height:56px;border-radius:6px;object-fit:cover;display:block}
    nav.pages{margin-top:1rem}nav.pages ul{display:flex;gap:1rem;list-style:none;padding:0}nav.pages .disabled{display:none}
    @media(max-width:700px){.grid2{grid-template-columns:1fr}table{font-size:.9rem}}
  </style>
</head>
<body>
@auth
<header>
  <strong>VELOURA ADMIN</strong>
  <a href="{{ route('admin.dashboard') }}" @class(['on' => request()->routeIs('admin.dashboard')])>Dashboard</a>
  <a href="{{ route('admin.orders.index') }}" @class(['on' => request()->routeIs('admin.orders.*')])>Orders</a>
  <a href="{{ route('admin.products.index') }}" @class(['on' => request()->routeIs('admin.products.*')])>Products</a>
  <a href="{{ route('admin.categories.index') }}" @class(['on' => request()->routeIs('admin.categories.*')])>Categories</a>
  <a href="{{ route('admin.enquiries.index') }}" @class(['on' => request()->routeIs('admin.enquiries.*')])>Enquiries</a>
  <form method="post" action="{{ route('admin.logout') }}">@csrf<button class="line">Log out</button></form>
</header>
@endauth
<main>
  @if (session('ok')) <div class="flash">{{ session('ok') }}</div> @endif
  @if ($errors->any()) <div class="err">@foreach ($errors->all() as $e) <div>{{ $e }}</div> @endforeach</div> @endif
  @yield('content')
</main>
</body>
</html>
