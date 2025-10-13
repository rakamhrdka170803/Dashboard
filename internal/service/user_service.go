package service

import (
	"errors"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/repository"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type UserService struct {
	users repository.UserRepository
	roles repository.RoleRepository
	auth  *AuthService
}

func NewUserService(users repository.UserRepository, roles repository.RoleRepository, auth *AuthService) *UserService {
	return &UserService{users: users, roles: roles, auth: auth}
}

type CreateUserInput struct {
	FullName string
	Email    string
	Password string
	Roles    []domain.RoleName
}

type UpdateUserInput struct { // 👈 ADD
	ID       uint
	FullName *string
	Email    *string
	Password *string
	PhotoURL *string
	Active   *bool
}

func (s *UserService) CreateUser(in CreateUserInput) (*domain.User, error) {
	if in.Email == "" || in.Password == "" || in.FullName == "" {
		return nil, errors.New("fullname/email/password required")
	}
	hash, err := s.auth.GeneratePasswordHash(in.Password)
	if err != nil {
		return nil, err
	}

	u := &domain.User{
		UUID:         uuid.New(),
		FullName:     in.FullName,
		Email:        in.Email,
		PasswordHash: hash,
		Active:       true,
	}

	// attach roles
	var rs []domain.Role
	for _, rn := range in.Roles {
		role, err := s.roles.Ensure(rn)
		if err != nil {
			return nil, err
		}
		rs = append(rs, *role)
	}
	u.Roles = rs
	if err := s.users.Create(u); err != nil {
		return nil, err
	}
	return u, nil
}

func (s *UserService) AssignRoles(userID uint, roleNames []domain.RoleName) error {
	var rs []domain.Role
	for _, rn := range roleNames {
		r, err := s.roles.Ensure(rn)
		if err != nil {
			return err
		}
		rs = append(rs, *r)
	}
	return s.users.AssignRoles(userID, rs)
}

func (s *UserService) GetByID(id uint) (*domain.User, error) {
	return s.users.FindByID(id)
}

func (s *UserService) List(page, size int) ([]domain.User, int64, error) {
	return s.users.List(page, size)
}

func (s *UserService) UpdateUser(in UpdateUserInput) (*domain.User, error) {
	u, err := s.users.FindByID(in.ID)
	if err != nil {
		return nil, err
	}

	fields := map[string]any{}
	if in.FullName != nil {
		fields["full_name"] = *in.FullName
	}
	if in.Email != nil {
		fields["email"] = *in.Email
	}
	if in.PhotoURL != nil {
		fields["photo_url"] = in.PhotoURL
	} // pointer disimpan apa adanya
	if in.Active != nil {
		fields["active"] = *in.Active
	}

	if in.Password != nil && *in.Password != "" {
		hash, err := s.auth.GeneratePasswordHash(*in.Password)
		if err != nil {
			return nil, err
		}
		fields["password_hash"] = hash
	}

	if len(fields) == 0 {
		return u, nil
	}

	if err := s.users.UpdateFields(u.ID, fields); err != nil {
		return nil, err
	}
	return s.users.FindByID(u.ID)
}

func (s *UserService) UpdateSelf(userID uint, in UpdateUserInput) (*domain.User, error) {
	in.ID = userID
	return s.UpdateUser(in) // reuse logic: hashing & fields map
}

func (s *UserService) DeleteUser(id uint) error {
	return s.users.Delete(id)
}

// Ganti password diri sendiri dengan verifikasi current password
func (s *UserService) ChangePassword(userID uint, current, newPass string) error {
	u, err := s.users.FindByID(userID)
	if err != nil {
		return err
	}

	// verify current
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(current)); err != nil {
		return errors.New("current password is incorrect")
	}
	if len(newPass) < 6 {
		return errors.New("new password too short")
	}
	hash, err := s.auth.GeneratePasswordHash(newPass)
	if err != nil {
		return err
	}

	return s.users.UpdateFields(userID, map[string]any{"password_hash": hash})
}
