package repository

import (
	"bjb-backoffice/internal/domain"

	"gorm.io/gorm"
)

type UserRepository interface {
	Create(u *domain.User) error
	FindByEmail(email string) (*domain.User, error)
	FindByID(id uint) (*domain.User, error)
	List(page, size int) ([]domain.User, int64, error)
	AssignRoles(userID uint, roles []domain.Role) error
	Update(u *domain.User) error                       // 👈 tetap
	UpdateFields(id uint, fields map[string]any) error // 👈 tetap
	Delete(id uint) error
	ListBackofficeIDs() ([]uint, error)

	// 👇 NEW: dipakai untuk broadcast notif ke semua user
	ListAllIDs() ([]uint, error)
}

type userRepository struct{ db *gorm.DB }

func NewUserRepository(db *gorm.DB) UserRepository { return &userRepository{db: db} }

func (r *userRepository) Create(u *domain.User) error { return r.db.Create(u).Error }

func (r *userRepository) FindByEmail(email string) (*domain.User, error) {
	var u domain.User
	err := r.db.Preload("Roles").Where("email = ?", email).First(&u).Error
	return &u, err
}

func (r *userRepository) FindByID(id uint) (*domain.User, error) {
	var u domain.User
	err := r.db.Preload("Roles").First(&u, id).Error
	return &u, err
}

func (r *userRepository) List(page, size int) ([]domain.User, int64, error) {
	var (
		users []domain.User
		total int64
	)
	r.db.Model(&domain.User{}).Count(&total)
	err := r.db.Preload("Roles").
		Limit(size).Offset((page - 1) * size).
		Order("id DESC").
		Find(&users).Error
	return users, total, err
}

func (r *userRepository) AssignRoles(userID uint, roles []domain.Role) error {
	var user domain.User
	if err := r.db.First(&user, userID).Error; err != nil {
		return err
	}
	return r.db.Model(&user).Association("Roles").Replace(roles)
}

func (r *userRepository) Delete(id uint) error {
	return r.db.Delete(&domain.User{}, id).Error
}

func (r *userRepository) Update(u *domain.User) error {
	return r.db.Save(u).Error
}

func (r *userRepository) UpdateFields(id uint, fields map[string]any) error {
	return r.db.Model(&domain.User{}).Where("id = ?", id).Updates(fields).Error
}

// 👇 NEW: ambil semua user.id (tidak peduli role) untuk broadcast
func (r *userRepository) ListAllIDs() ([]uint, error) {
	var ids []uint
	if err := r.db.Model(&domain.User{}).Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	return ids, nil
}

func (r *userRepository) ListBackofficeIDs() ([]uint, error) {
	type row struct{ ID uint }
	var rows []row
	// ambil user yg punya role BACKOFFICE
	err := r.db.Table("users").
		Select("users.id").
		Joins("JOIN user_roles ur ON ur.user_id = users.id").
		Joins("JOIN roles r ON r.id = ur.role_id").
		Where("r.name = ?", "BACKOFFICE").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]uint, 0, len(rows))
	for _, v := range rows {
		out = append(out, v.ID)
	}
	return out, nil
}
