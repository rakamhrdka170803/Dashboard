// router/router.go (FIXED)
package router

import (
	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/http/handler"
	"bjb-backoffice/internal/http/middleware"

	"github.com/gin-gonic/gin"
)

func Setup(
	r *gin.Engine,
	authH *handler.AuthHandler,
	userH *handler.UserHandler,
	findingH *handler.FindingHandler,
	lateH *handler.LatenessHandler,
	schedH *handler.ScheduleHandler,
	leaveH *handler.LeaveHandler,
	swapH *handler.SwapHandler,
	notifH *handler.NotificationHandler,
	holidayH *handler.HolidaySwapHandler,
	jwtSecret []byte,
) {
	r.SetTrustedProxies(nil)
	api := r.Group("/api/v1")
	api.POST("/auth/login", authH.Login)

	secured := api.Group("/")
	secured.Use(middleware.JWTAuth(jwtSecret))

	// self-service
	secured.GET("/me", userH.Me)
	secured.PUT("/me", userH.UpdateMe)
	secured.PUT("/me/password", userH.ChangePassword)

	// users list: backoffice
	secured.GET("/users",
		middleware.RequireRoles(
			string(domain.RoleSuperAdmin),
			string(domain.RoleSPV),
			string(domain.RoleQC),
			string(domain.RoleTL),
			string(domain.RoleHRAdmin),
		),
		userH.List,
	)

	// users CRUD: SUPER_ADMIN
	adminOnly := secured.Group("/")
	adminOnly.Use(middleware.RequireRoles(string(domain.RoleSuperAdmin)))
	adminOnly.POST("/users", userH.Create)
	adminOnly.GET("/users/:id", userH.GetByID)
	adminOnly.PUT("/users/:id", userH.Update)
	adminOnly.PATCH("/users/:id/roles", userH.AssignRoles)
	adminOnly.DELETE("/users/:id", userH.Delete)

	// USERS (mini) – boleh diakses semua yang login
	secured.GET("/users/mini", userH.ListMini)

	// === SCHEDULES ===
	// GET (lihat jadwal) – semua login; agent dibatasi di handler
	secured.GET("/schedules/monthly", schedH.ListMonthly)
	secured.GET("/schedules/monthly-all", schedH.ListMonthlyAll)
	secured.GET("/users/:id/off-days", schedH.OffDays)

	// Create/Update/Delete – role tertentu saja
	schedAdmin := secured.Group("/schedules")
	schedAdmin.Use(middleware.RequireRoles(string(domain.RoleHRAdmin), string(domain.RoleTL), string(domain.RoleSuperAdmin)))
	schedAdmin.POST("", schedH.Create)
	schedAdmin.PUT("/:id", schedH.Update)
	schedAdmin.DELETE("/:id", schedH.Delete)

	// FINDINGS
	findingsGroup := secured.Group("/findings")
	findingsGroup.Use(middleware.RequireRoles(
		string(domain.RoleQC), string(domain.RoleSPV), string(domain.RoleTL), string(domain.RoleHRAdmin), string(domain.RoleSuperAdmin),
	))
	findingsGroup.POST("", findingH.Create)
	findingsGroup.DELETE("/:id", findingH.Delete)
	secured.GET("/findings", findingH.List)

	// Lateness
	latGroup := secured.Group("/lateness")
	latGroup.Use(middleware.RequireRoles(
		string(domain.RoleHRAdmin),
		string(domain.RoleSPV),
		string(domain.RoleTL),
		string(domain.RoleSuperAdmin),
	))
	latGroup.POST("", lateH.Create)
	latGroup.DELETE("/:id", lateH.Delete)
	secured.GET("/lateness", lateH.List)

	// Leave
	secured.POST("/leave-requests", leaveH.Create)
	leaveAdmin := secured.Group("/leave-requests")
	leaveAdmin.Use(middleware.RequireRoles(string(domain.RoleHRAdmin), string(domain.RoleSuperAdmin)))
	leaveAdmin.PATCH("/:id/approve", leaveH.Approve)
	leaveAdmin.PATCH("/:id/reject", leaveH.Reject)

	// Swaps
	secured.POST("/swaps", swapH.Create)
	secured.GET("/swaps", swapH.List)
	swapAgent := secured.Group("/swaps")
	swapAgent.Use(middleware.RequireRoles(string(domain.RoleAgent)))
	swapAgent.PATCH("/:id/accept", swapH.Accept)
	swapAgent.PATCH("/:id/cancel", swapH.Cancel)

	// Notifications
	secured.GET("/notifications", notifH.ListMine)
	secured.PATCH("/notifications/:id/read", notifH.MarkRead)

	// === Holiday Swaps ===
	// Create & List – semua user login (visibility di handler)
	secured.POST("/holiday-swaps", holidayH.Create)
	secured.GET("/holiday-swaps", holidayH.List)
	// Agent (target) accept/reject
	holidayAgent := secured.Group("/holiday-swaps")
	holidayAgent.Use(middleware.RequireRoles(string(domain.RoleAgent)))
	holidayAgent.POST("/:id/accept", holidayH.TargetAccept)
	holidayAgent.POST("/:id/reject", holidayH.TargetReject)

	// Backoffice approve (buat jadwal)
	holidayAdmin := secured.Group("/holiday-swaps")
	holidayAdmin.Use(middleware.RequireRoles(
		string(domain.RoleHRAdmin),
		string(domain.RoleTL),
		string(domain.RoleSuperAdmin),
		string(domain.RoleSPV), // ⬅️ NEW
		string(domain.RoleQC),  // ⬅️ NEW
	))
	holidayAdmin.POST("/:id/bo-approve", holidayH.BOApprove)

	// Cancel oleh pengaju (agent)
	holidayAgent.POST("/:id/cancel", holidayH.Cancel)

}
