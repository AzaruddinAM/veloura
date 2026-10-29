<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        // Only failed attempts count, per email + IP, so staff sharing the shop's
        // Wi-Fi are not locked out by each other's normal logins.
        $key = 'admin-login:'.Str::lower($data['email']).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            $wait = RateLimiter::availableIn($key);
            throw ValidationException::withMessages(['email' => "Too many wrong attempts. Try again in {$wait} seconds."])->status(429);
        }

        $user = User::where('email', $data['email'])->first();
        if (! $user?->is_admin || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($key, 60);
            throw ValidationException::withMessages(['email' => 'Wrong email or password.']);
        }
        RateLimiter::clear($key);

        return [
            'token' => $user->createToken('admin-panel')->plainTextToken,
            'user' => $this->user($user),
        ];
    }

    public function me(Request $request)
    {
        return $this->user($request->user());
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    public function password(Request $request)
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();
        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'Your current password is not correct.']);
        }

        $user->update(['password' => $data['password']]);
        // Sign out every other device that was logged in with the old password.
        $user->tokens()->whereKeyNot($user->currentAccessToken()->getKey())->delete();

        return response()->noContent();
    }

    private function user(User $user): array
    {
        return ['name' => $user->name, 'email' => $user->email];
    }
}
