package database

import (
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"bjb-backoffice/internal/domain"
)

func Connect(dsn string) *gorm.DB {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}

	// Auto-migrate
	if err := db.AutoMigrate(
		&domain.Role{}, &domain.User{}, &domain.UserRole{},
		&domain.Finding{}, &domain.Lateness{},
		&domain.Schedule{}, &domain.LeaveRequest{}, &domain.SwapRequest{}, &domain.Notification{},
	); err != nil {
		log.Fatalf("auto-migrate: %v", err)
	}

	return db
}
