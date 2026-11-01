package com.kirana.catalog;

import com.kirana.common.TimestampedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "categories")
public class Category extends TimestampedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    /** Optional Hindi name; the apps fall back to {@link #name}. */
    private String nameHi;
    private String slug;
    private String imageUrl;
    private int sortOrder;

    @Column(name = "is_active")
    private boolean active = true;
}
