<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'phone', 'message', 'is_read', 'ip'])]
class Enquiry extends Model
{
    protected function casts(): array
    {
        return ['is_read' => 'boolean'];
    }
}
