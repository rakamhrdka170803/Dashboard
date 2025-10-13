package seed

import (
	"log"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/repository"
	"bjb-backoffice/internal/service"
)

func Bootstrap(roles repository.RoleRepository, users repository.UserRepository, userSvc *service.UserService, superAdminEmail, superAdminPass string) {
	// Ensure all roles exist
	for _, rn := range []domain.RoleName{
		domain.RoleSuperAdmin, domain.RoleSPV, domain.RoleQC, domain.RoleTL, domain.RoleHRAdmin, domain.RoleAgent,
	} {
		if _, err := roles.Ensure(rn); err != nil {
			log.Fatalf("ensure role %s: %v", rn, err)
		}
	}

	// ensure super admin user
	if _, err := users.FindByEmail(superAdminEmail); err != nil {
		_, err2 := userSvc.CreateUser(service.CreateUserInput{
			FullName: "Super Admin",
			Email:    superAdminEmail,
			Password: superAdminPass,
			Roles:    []domain.RoleName{domain.RoleSuperAdmin},
		})
		if err2 != nil {
			log.Fatalf("seed super admin: %v", err2)
		}
	}
}
