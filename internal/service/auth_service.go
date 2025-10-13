package service

import (
	"errors"
	"time"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	users     repository.UserRepository
	jwtSecret []byte
	issuer    string
	expHours  int
}

func NewAuthService(users repository.UserRepository, jwtSecret, issuer string, expH int) *AuthService {
	return &AuthService{users: users, jwtSecret: []byte(jwtSecret), issuer: issuer, expHours: expH}
}

func (a *AuthService) GeneratePasswordHash(pw string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	return string(b), err
}

func (a *AuthService) Login(email, password string) (string, *domain.User, error) {
	u, err := a.users.FindByEmail(email)
	if err != nil {
		return "", nil, errors.New("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return "", nil, errors.New("invalid credentials")
	}

	claims := jwt.MapClaims{
		"sub": u.ID,
		"iss": a.issuer,
		"exp": time.Now().Add(time.Duration(a.expHours) * time.Hour).Unix(),
		"roles": func() []string {
			out := make([]string, 0, len(u.Roles))
			for _, r := range u.Roles {
				out = append(out, string(r.Name))
			}
			return out
		}(),
		"email": u.Email,
		"name":  u.FullName,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	ss, err := token.SignedString(a.jwtSecret)
	return ss, u, err
}
