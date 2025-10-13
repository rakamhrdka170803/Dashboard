package domain

import "time"

type RoleName string

const (
	RoleSuperAdmin RoleName = "SUPER_ADMIN"
	RoleSPV        RoleName = "SPV"
	RoleQC         RoleName = "QC"       // (A Dhani)
	RoleTL         RoleName = "TL"       // (A Ferdy)
	RoleHRAdmin    RoleName = "HR_ADMIN" // (Teh Sani)
	RoleAgent      RoleName = "AGENT"
)

type Role struct {
	ID        uint     `gorm:"primaryKey"`
	Name      RoleName `gorm:"uniqueIndex;size:50;not null"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

type UserRole struct {
	UserID uint `gorm:"primaryKey"`
	RoleID uint `gorm:"primaryKey"`
	Role   Role `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
