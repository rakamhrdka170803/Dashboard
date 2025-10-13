package domain

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uint      `gorm:"primaryKey"`
	UUID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();uniqueIndex"`
	FullName     string    `gorm:"size:120;not null"`
	Email        string    `gorm:"size:160;uniqueIndex;not null"`
	PasswordHash string    `gorm:"size:255;not null"`
	PhotoURL     *string   `gorm:"size:255"` // 👈 ADD THIS
	Active       bool      `gorm:"default:true"`

	Roles     []Role     `gorm:"many2many:user_roles;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	UserRoles []UserRole `gorm:"foreignKey:UserID"`

	CreatedAt time.Time
	UpdatedAt time.Time
}
