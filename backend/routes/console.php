<?php

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Validator;

Artisan::command('admin:create {email} {--name=Veloura Admin} {--password=}', function (string $email) {
    $password = $this->option('password') ?: $this->secret('Password (min 8 characters)');

    $v = Validator::make(['email' => $email, 'password' => $password], [
        'email' => ['required', 'email'],
        'password' => ['required', 'string', 'min:8'],
    ]);
    if ($v->fails()) {
        foreach ($v->errors()->all() as $e) {
            $this->error($e);
        }

        return 1;
    }

    $user = User::firstOrNew(['email' => $email]);
    $user->name = $user->name ?: $this->option('name');
    $user->password = $password;
    $user->is_admin = true;
    $user->save();

    $this->info("Admin {$email} is ready. Log in at ".url('/adminpannel/'));
})->purpose('Create an admin login (or reset its password)');
