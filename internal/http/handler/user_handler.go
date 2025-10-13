package handler

import (
	"net/http"
	"strconv"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type UserHandler struct{ svc *service.UserService }

func NewUserHandler(s *service.UserService) *UserHandler { return &UserHandler{svc: s} }

func (h *UserHandler) Me(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)

	// kita simpan "sub" = userID saat login
	idf, ok := claims["sub"].(float64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid subject"})
		return
	}
	uid := uint(idf)

	u, err := h.svc.GetByID(uid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":        u.ID,
		"uuid":      u.UUID,
		"full_name": u.FullName,
		"email":     u.Email,
		"roles":     userRolesToStrings(u),
		"active":    u.Active,
	})
}

func (h *UserHandler) List(c *gin.Context) {
	pageStr := c.DefaultQuery("page", "1")
	sizeStr := c.DefaultQuery("size", "10")
	page, _ := strconv.Atoi(pageStr)
	size, _ := strconv.Atoi(sizeStr)
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 10
	}

	users, total, err := h.svc.List(page, size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	items := make([]gin.H, 0, len(users))
	for _, u := range users {
		items = append(items, gin.H{
			"id": u.ID, "uuid": u.UUID, "full_name": u.FullName, "email": u.Email,
			"roles":  func() []string { return userRolesToStrings(&u) }(),
			"active": u.Active,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"page": page, "size": size, "total": total, "items": items,
	})
}

type createUserReq struct {
	FullName string            `json:"full_name" binding:"required"`
	Email    string            `json:"email" binding:"required,email"`
	Password string            `json:"password" binding:"required,min=6"`
	Roles    []domain.RoleName `json:"roles" binding:"required"`
}

func (h *UserHandler) Create(c *gin.Context) {
	var req createUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	u, err := h.svc.CreateUser(service.CreateUserInput{
		FullName: req.FullName,
		Email:    req.Email,
		Password: req.Password,
		Roles:    req.Roles,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id": u.ID, "uuid": u.UUID, "full_name": u.FullName, "email": u.Email,
		"roles": func() []string {
			rr := []string{}
			for _, r := range u.Roles {
				rr = append(rr, string(r.Name))
			}
			return rr
		}(),
	})
}

type assignRolesReq struct {
	Roles []domain.RoleName `json:"roles" binding:"required"`
}

func (h *UserHandler) AssignRoles(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req assignRolesReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.AssignRoles(uint(id), req.Roles); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func userRolesToStrings(u *domain.User) []string {
	out := make([]string, 0, len(u.Roles))
	for _, r := range u.Roles {
		out = append(out, string(r.Name))
	}
	return out
}

type updateMeReq struct {
	FullName        *string `json:"full_name"`
	Email           *string `json:"email"`
	PhotoURL        *string `json:"photo_url"`
	CurrentPassword *string `json:"current_password"` // wajib jika ganti email
}

func (h *UserHandler) UpdateMe(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, ok := claims["sub"].(float64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid subject"})
		return
	}
	uid := uint(idf)

	var req updateMeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// jika mau ganti email → minta current password
	if req.Email != nil {
		if req.CurrentPassword == nil || *req.CurrentPassword == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "current_password required to change email"})
			return
		}
		// verify current password before changing email
		u, err := h.svc.GetByID(uid)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(*req.CurrentPassword)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "current password is incorrect"})
			return
		}
	}

	updated, err := h.svc.UpdateSelf(uid, service.UpdateUserInput{
		FullName: req.FullName,
		Email:    req.Email,
		PhotoURL: req.PhotoURL,
		// Active & Password tidak boleh via /me (kecuali endpoint khusus password di bawah)
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id": updated.ID, "uuid": updated.UUID, "full_name": updated.FullName,
		"email": updated.Email, "photo_url": updated.PhotoURL, "roles": userRolesToStrings(updated),
		"active": updated.Active,
	})
}

// ====== Ganti password diri sendiri ======
type changePasswordReq struct {
	Current string `json:"current" binding:"required"`
	New     string `json:"new" binding:"required,min=6"`
}

func (h *UserHandler) ChangePassword(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, ok := claims["sub"].(float64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid subject"})
		return
	}
	uid := uint(idf)

	var req changePasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.ChangePassword(uid, req.Current, req.New); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "password changed"})
}

func (h *UserHandler) GetByID(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	u, err := h.svc.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id": u.ID, "uuid": u.UUID, "full_name": u.FullName, "email": u.Email,
		"photo_url": u.PhotoURL, "roles": userRolesToStrings(u), "active": u.Active,
	})
}

type updateUserReq struct {
	FullName *string `json:"full_name"`
	Email    *string `json:"email"`
	Password *string `json:"password"`  // optional
	PhotoURL *string `json:"photo_url"` // optional
	Active   *bool   `json:"active"`    // optional
}

// ----- PUT /users/:id -----
func (h *UserHandler) Update(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req updateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	u, err := h.svc.UpdateUser(service.UpdateUserInput{
		ID:       uint(id),
		FullName: req.FullName,
		Email:    req.Email,
		Password: req.Password,
		PhotoURL: req.PhotoURL,
		Active:   req.Active,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id": u.ID, "uuid": u.UUID, "full_name": u.FullName, "email": u.Email,
		"photo_url": u.PhotoURL, "roles": userRolesToStrings(u), "active": u.Active,
	})
}

// ----- DELETE /users/:id -----
func (h *UserHandler) Delete(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := h.svc.DeleteUser(uint(id)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
