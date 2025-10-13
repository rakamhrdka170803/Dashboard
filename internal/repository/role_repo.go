package repository

import (
	"bjb-backoffice/internal/domain"

	"gorm.io/gorm"
)

type RoleRepository interface {
	FindByName(name domain.RoleName) (*domain.Role, error)
	Ensure(name domain.RoleName) (*domain.Role, error)
	List() ([]domain.Role, error)
}

type roleRepository struct{ db *gorm.DB }

func NewRoleRepository(db *gorm.DB) RoleRepository { return &roleRepository{db: db} }

func (r *roleRepository) FindByName(name domain.RoleName) (*domain.Role, error) {
	var role domain.Role
	if err := r.db.Where("name = ?", name).First(&role).Error; err != nil {
		return nil, err
	}
	return &role, nil
}

func (r *roleRepository) Ensure(name domain.RoleName) (*domain.Role, error) {
	role := domain.Role{Name: name}
	if err := r.db.Where("name = ?", name).FirstOrCreate(&role).Error; err != nil {
		return nil, err
	}
	return &role, nil
}

func (r *roleRepository) List() ([]domain.Role, error) {
	var roles []domain.Role
	return roles, r.db.Find(&roles).Error
}
