package main

import (
	"log"
	"time"

	"bjb-backoffice/internal/config"
	"bjb-backoffice/internal/database"
	"bjb-backoffice/internal/domain"
	httpHandler "bjb-backoffice/internal/http/handler"
	httpRouter "bjb-backoffice/internal/http/router"
	"bjb-backoffice/internal/repository"
	"bjb-backoffice/internal/service"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()
	db := database.Connect(cfg.DBDSN)

	// AutoMigrate
	if err := db.AutoMigrate(
		&domain.HolidaySwap{},
		&domain.LeaveRequest{}, // NEW
		&domain.Finding{},
		&domain.CWCEntry{}, // kalau belum dimigrate
	); err != nil {
		log.Fatal("auto-migrate failed: ", err)
	}

	// repos
	roleRepo := repository.NewRoleRepository(db)
	userRepo := repository.NewUserRepository(db)
	findingRepo := repository.NewFindingRepository(db)
	lateRepo := repository.NewLatenessRepository(db)
	schedRepo := repository.NewScheduleRepository(db)
	leaveRepo := repository.NewLeaveRepository(db)
	swapRepo := repository.NewSwapRepository(db)
	notifRepo := repository.NewNotificationRepository(db)
	holidayRepo := repository.NewHolidaySwapRepository(db)
	cwcRepo := repository.NewCWCRepository(db)

	// services
	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret, cfg.JWTIssuer, cfg.JWTExpiryH)
	userSvc := service.NewUserService(userRepo, roleRepo, authSvc)
	findingSvc := service.NewFindingService(findingRepo, userRepo)
	notifSvc := service.NewNotificationService(notifRepo)
	lateSvc := service.NewLatenessService(lateRepo, userRepo)
	schedSvc := service.NewScheduleService(schedRepo)
	leaveSvc := service.NewLeaveService(leaveRepo, userRepo, notifSvc, findingSvc, schedSvc) // pass schedSvc
	swapSvc := service.NewSwapService(swapRepo, schedSvc, notifSvc, userRepo)
	holidaySvc := service.NewHolidaySwapService(holidayRepo, schedSvc, notifSvc, userRepo)
	cwcSvc := service.NewCWCService(cwcRepo)

	// handlers
	authH := httpHandler.NewAuthHandler(authSvc)
	userH := httpHandler.NewUserHandler(userSvc)
	findingH := httpHandler.NewFindingHandler(findingSvc)
	lateH := httpHandler.NewLatenessHandler(lateSvc)
	schedH := httpHandler.NewScheduleHandler(schedSvc, userRepo)
	leaveH := httpHandler.NewLeaveHandler(leaveSvc)
	swapH := httpHandler.NewSwapHandler(swapSvc, schedSvc, userSvc)
	notifH := httpHandler.NewNotificationHandler(notifSvc)
	holidayH := httpHandler.NewHolidaySwapHandler(holidaySvc)
	cwcH := httpHandler.NewCWCHandler(cwcSvc)

	// Gin & CORS
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// STATIC for uploads
	r.Static("/uploads", "./uploads")

	// Router
	httpRouter.Setup(
		r,
		authH, userH, findingH, lateH, schedH, leaveH, swapH, notifH, holidayH, cwcH,
		[]byte(cfg.JWTSecret),
	)

	log.Println("listening on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
