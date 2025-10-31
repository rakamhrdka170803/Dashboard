package repository

import (
	"time"

	"bjb-backoffice/internal/domain"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type CWCRepository interface {
	UpsertBatch(date time.Time, items []domain.CWCEntry) error
	QueryRange(start, end time.Time) ([]domain.CWCEntry, error)
	GetByDate(date time.Time) ([]domain.CWCEntry, error) // NEW
	DeleteByDate(date time.Time) error
}

type cwcRepository struct{ db *gorm.DB }

func NewCWCRepository(db *gorm.DB) CWCRepository { return &cwcRepository{db: db} }

func (r *cwcRepository) UpsertBatch(date time.Time, items []domain.CWCEntry) error {
	if len(items) == 0 {
		return nil
	}
	for i := range items {
		items[i].Date = date
	}
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "date"}, {Name: "category"}, {Name: "sub_key"}},
		DoUpdates: clause.Assignments(map[string]interface{}{"count": gorm.Expr("EXCLUDED.count")}),
	}).Create(&items).Error
}

func (r *cwcRepository) GetByDate(date time.Time) ([]domain.CWCEntry, error) {
	var rows []domain.CWCEntry
	err := r.db.Where("date = ?", date).Order("category ASC, sub_key ASC").Find(&rows).Error
	return rows, err
}

func (r *cwcRepository) DeleteByDate(date time.Time) error {
	return r.db.Where("date = ?", date).Delete(&domain.CWCEntry{}).Error
}

func (r *cwcRepository) QueryRange(start, end time.Time) ([]domain.CWCEntry, error) {
	var rows []domain.CWCEntry
	err := r.db.
		Model(&domain.CWCEntry{}).
		Where("date >= ? AND date <= ?", start, end).
		Order("date ASC, category ASC").
		Find(&rows).Error
	return rows, err
}
