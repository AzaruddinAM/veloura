<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['ref', 'customer_name', 'phone', 'address', 'note', 'total', 'status', 'channel', 'ip'])]
class Order extends Model
{
    public const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

    protected function casts(): array
    {
        return ['total' => 'integer'];
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
