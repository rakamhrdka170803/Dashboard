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

	// FINDINGS
	// QC (dan SPV/TL/HR) boleh create/delete/list; Agent hanya bisa list miliknya (handler enforce)
	findingsGroup := secured.Group("/findings")
	findingsGroup.Use(middleware.RequireRoles(
		string(domain.RoleQC), string(domain.RoleSPV), string(domain.RoleTL), string(domain.RoleHRAdmin), string(domain.RoleSuperAdmin),
		// Agent tidak disertakan di sini karena Agent tidak boleh create/delete;
		// tapi Agent boleh GET /findings (handler akan enforce miliknya) → buat grup GET khusus tanpa RequireRoles
	))
	findingsGroup.POST("", findingH.Create)
	findingsGroup.DELETE("/:id", findingH.Delete)

	// GET bisa diakses siapa pun yang login (Agent/backoffice), handler akan enforce agent visibility
	secured.GET("/findings", findingH.List)

	// GROUP: Lateness
	// Create/Delete oleh HR, SPV, TL, SUPER_ADMIN
	latGroup := secured.Group("/lateness")
	latGroup.Use(middleware.RequireRoles(
		string(domain.RoleHRAdmin),
		string(domain.RoleSPV),
		string(domain.RoleTL),
		string(domain.RoleSuperAdmin),
	))
	latGroup.POST("", lateH.Create)
	latGroup.DELETE("/:id", lateH.Delete)

	// GET bisa diakses siapa pun yang login (Agent hanya miliknya)
	secured.GET("/lateness", lateH.List)

	// SCHEDULES
	// GET monthly: semua login; agent hanya miliknya (handler enforce)
	secured.GET("/schedules/monthly", schedH.ListMonthly)
	// (opsional) create/update schedule khusus HR/TL/SUPER_ADMIN
	schedAdmin := secured.Group("/schedules")
	schedAdmin.Use(middleware.RequireRoles(string(domain.RoleHRAdmin), string(domain.RoleTL), string(domain.RoleSuperAdmin)))
	schedAdmin.POST("", schedH.Create)
	schedAdmin.PUT("/:id", schedH.Update)
	schedAdmin.DELETE("/:id", schedH.Delete)

	// LEAVE REQUESTS
	// create: semua login boleh
	secured.POST("/leave-requests", leaveH.Create)
	// approve/reject: HR only
	leaveAdmin := secured.Group("/leave-requests")
	leaveAdmin.Use(middleware.RequireRoles(string(domain.RoleHRAdmin), string(domain.RoleSuperAdmin)))
	leaveAdmin.PATCH("/:id/approve", leaveH.Approve)
	leaveAdmin.PATCH("/:id/reject", leaveH.Reject)

	// SWAP REQUESTS
	// create/list: semua login (agent buat; yang lain bisa lihat)
	secured.POST("/swaps", swapH.Create)
	secured.GET("/swaps", swapH.List)
	// accept: khusus AGENT
	swapAgent := secured.Group("/swaps")
	swapAgent.Use(middleware.RequireRoles(string(domain.RoleAgent)))
	swapAgent.PATCH("/:id/accept", swapH.Accept)
	swapAgent.PATCH("/:id/cancel", swapH.Cancel)

	// NOTIFICATIONS
	secured.GET("/notifications", notifH.ListMine)
	secured.PATCH("/notifications/:id/read", notifH.MarkRead)

}
