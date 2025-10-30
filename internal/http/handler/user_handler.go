package handler

import (
	"fmt"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

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
		"photo_url": u.PhotoURL, // ⬅️ penting untuk Topbar & Profile
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

	// ambil user saat ini untuk membandingkan email
	current, err := h.svc.GetByID(uid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// minta current password HANYA jika email benar-benar berubah
	if req.Email != nil && *req.Email != current.Email {
		if req.CurrentPassword == nil || *req.CurrentPassword == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "current_password required to change email"})
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(current.PasswordHash), []byte(*req.CurrentPassword)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "current password is incorrect"})
			return
		}
	} else {
		// email tidak berubah → jangan kirim ke service agar tidak memicu validasi unik/email
		req.Email = nil
	}

	updated, err := h.svc.UpdateSelf(uid, service.UpdateUserInput{
		FullName: req.FullName,
		Email:    req.Email,    // nil jika tidak berubah
		PhotoURL: req.PhotoURL, // boleh nil
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

// ====== Upload foto diri sendiri: POST /me/photo ======

func isImage(fh *multipart.FileHeader) bool {
	ct := fh.Header.Get("Content-Type")
	if strings.HasPrefix(ct, "image/") {
		return true
	}
	ext := strings.ToLower(filepath.Ext(fh.Filename))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp":
		return true
	default:
		return false
	}
}

func (h *UserHandler) UploadMyPhoto(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, ok := claims["sub"].(float64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid subject"})
		return
	}
	uid := uint(idf)

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	if file.Size > 2*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large (max 2MB)"})
		return
	}
	if !isImage(file) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid image type"})
		return
	}

	// pastikan folder ada
	dstDir := filepath.Join("uploads", "avatars")
	if mkErr := os.MkdirAll(dstDir, 0755); mkErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare storage"})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		ext = ".jpg"
	}
	dstRel := filepath.Join("uploads", "avatars", fmt.Sprintf("%d_%d%s", uid, time.Now().Unix(), ext))

	if err := c.SaveUploadedFile(file, dstRel); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}

	photoURL := "/" + filepath.ToSlash(dstRel)
	if _, err := h.svc.UpdateSelf(uid, service.UpdateUserInput{PhotoURL: &photoURL}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user photo"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"photo_url": photoURL})
}

// ====== util ======

func hasRole(u *domain.User, rn domain.RoleName) bool {
	for _, r := range u.Roles {
		if r.Name == rn {
			return true
		}
	}
	return false
}

// GET /api/v1/users/mini?only_agents=true
func (h *UserHandler) ListMini(c *gin.Context) {
	page, size := 1, 500
	if v := c.Query("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			page = n
		}
	}
	if v := c.Query("size"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 2000 {
			size = n
		}
	}

	// default: hanya agent
	onlyAgents := c.DefaultQuery("only_agents", "true") == "true"

	users, _, err := h.svc.List(page, size) // preload roles di repo agar Roles terisi
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	out := make([]gin.H, 0, len(users))
	for i := range users {
		u := &users[i]
		if onlyAgents && !hasRole(u, domain.RoleAgent) {
			continue
		}
		out = append(out, gin.H{"id": u.ID, "full_name": u.FullName})
	}

	c.JSON(http.StatusOK, gin.H{"items": out})
}
