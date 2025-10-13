package main

import (
	"log"
	"os"
	"time"

	"bjb-backoffice/internal/config"
	"bjb-backoffice/internal/database"
	"bjb-backoffice/internal/http/handler"
	"bjb-backoffice/internal/http/router"
	"bjb-backoffice/internal/repository"
	"bjb-backoffice/internal/seed"
	"bjb-backoffice/internal/service"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()
	db := database.Connect(cfg.DBDSN)

	roleRepo := repository.NewRoleRepository(db)
	userRepo := repository.NewUserRepository(db)
	findingRepo := repository.NewFindingRepository(db)
	lateRepo := repository.NewLatenessRepository(db)
	schedRepo := repository.NewScheduleRepository(db)
	leaveRepo := repository.NewLeaveRepository(db)
	swapRepo := repository.NewSwapRepository(db)
	notifRepo := repository.NewNotificationRepository(db)

	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret, cfg.JWTIssuer, cfg.JWTExpiryH)
	userSvc := service.NewUserService(userRepo, roleRepo, authSvc)
	findingSvc := service.NewFindingService(findingRepo, userRepo)
	notifSvc := service.NewNotificationService(notifRepo)
	lateSvc := service.NewLatenessService(lateRepo, userRepo)
	schedSvc := service.NewScheduleService(schedRepo)
	leaveSvc := service.NewLeaveService(leaveRepo, userRepo, notifSvc, findingSvc)
	swapSvc := service.NewSwapService(swapRepo, schedSvc, notifSvc, userRepo)

	// seed roles + super admin
	seed.Bootstrap(roleRepo, userRepo, userSvc,
		os.Getenv("SEED_SUPERADMIN_EMAIL"),
		os.Getenv("SEED_SUPERADMIN_PASSWORD"),
	)

	authH := handler.NewAuthHandler(authSvc)
	userH := handler.NewUserHandler(userSvc)
	findingH := handler.NewFindingHandler(findingSvc)
	lateH := handler.NewLatenessHandler(lateSvc)
	schedH := handler.NewScheduleHandler(schedSvc, userRepo)
	leaveH := handler.NewLeaveHandler(leaveSvc)
	swapH := handler.NewSwapHandler(swapSvc, schedSvc)
	notifH := handler.NewNotificationHandler(notifSvc)

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	router.Setup(r, authH, userH, findingH, lateH, schedH, leaveH, swapH, notifH, []byte(cfg.JWTSecret))

	log.Println("listening on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
