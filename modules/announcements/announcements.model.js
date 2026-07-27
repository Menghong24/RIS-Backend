const mongoose = require("mongoose");

const TARGET_TYPES = [
  "global",
  "branch",
  "class"
];

const ANNOUNCEMENT_STATUSES = [
  "published",
  "draft",
  "archived"
];

const attachmentSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        trim: true,
        required: [
          true,
          "Attachment name is required"
        ]
      },

      path: {
        type: String,
        trim: true,
        required: [
          true,
          "Attachment path is required"
        ]
      }
    },
    {
      _id: false
    }
  );

const announcementSchema =
  new mongoose.Schema(
    {
      /*
        global:
        branch = null

        branch:
        branch = Branch ObjectId

        class:
        branch = Branch ObjectId
        targetClass = Class ObjectId
      */
      branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
        default: null,
        index: true
      },

      title: {
        type: String,
        required: [
          true,
          "Title is required"
        ],
        trim: true,
        maxlength: [
          250,
          "Title cannot exceed 250 characters"
        ]
      },

      content: {
        type: String,
        required: [
          true,
          "Content is required"
        ],
        trim: true
      },

      targetType: {
        type: String,
        enum: TARGET_TYPES,
        default: "branch",
        index: true
      },

      targetClass: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
        default: null,
        index: true
      },

      /*
        Store the User account that created
        the announcement.

        This supports global admins,
        branch admins, and teachers.
      */
      postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [
          true,
          "Posted by user is required"
        ],
        index: true
      },

      postDate: {
        type: Date,
        default: Date.now,
        index: true
      },

      expireDate: {
        type: Date,
        default: null,
        index: true
      },

      status: {
        type: String,
        enum: ANNOUNCEMENT_STATUSES,
        default: "published",
        index: true
      },

      // For example: pinned, comments enabled, or actionable
      action: {
        type: Boolean,
        default: true
      },

      attachments: {
        type: [attachmentSchema],
        default: []
      },

      remark: {
        type: String,
        trim: true,
        default: ""
      }
    },
    {
      timestamps: true,
      strict: true,
      toJSON: {
        virtuals: true
      },
      toObject: {
        virtuals: true
      }
    }
  );

// ======================================================
// Validation and normalization
// ======================================================

announcementSchema.pre(
  "validate",
  function (next) {
    if (this.title) {
      this.title = String(
        this.title
      ).trim();
    }

    if (this.content) {
      this.content = String(
        this.content
      ).trim();
    }

    if (this.targetType) {
      this.targetType = String(
        this.targetType
      )
        .trim()
        .toLowerCase();
    }

    if (this.status) {
      this.status = String(
        this.status
      )
        .trim()
        .toLowerCase();
    }

    if (this.remark) {
      this.remark = String(
        this.remark
      ).trim();
    }

    /*
      Global announcement:
      - No branch
      - No target class
    */
    if (this.targetType === "global") {
      this.branch = null;
      this.targetClass = null;
    }

    /*
      Branch announcement:
      - Branch is required
      - No target class
    */
    if (this.targetType === "branch") {
      if (!this.branch) {
        this.invalidate(
          "branch",
          "Branch is required for a branch announcement"
        );
      }

      this.targetClass = null;
    }

    /*
      Class announcement:
      - Branch is required
      - Target class is required
    */
    if (this.targetType === "class") {
      if (!this.branch) {
        this.invalidate(
          "branch",
          "Branch is required for a class announcement"
        );
      }

      if (!this.targetClass) {
        this.invalidate(
          "targetClass",
          "Target class is required for a class announcement"
        );
      }
    }

    if (
      this.postDate &&
      Number.isNaN(
        new Date(
          this.postDate
        ).getTime()
      )
    ) {
      this.invalidate(
        "postDate",
        "Post date is not valid"
      );
    }

    if (
      this.expireDate &&
      Number.isNaN(
        new Date(
          this.expireDate
        ).getTime()
      )
    ) {
      this.invalidate(
        "expireDate",
        "Expire date is not valid"
      );
    }

    if (
      this.expireDate &&
      this.postDate &&
      new Date(this.expireDate) <=
        new Date(this.postDate)
    ) {
      this.invalidate(
        "expireDate",
        "Expire date must be later than post date"
      );
    }

    next();
  }
);

// ======================================================
// Virtual fields
// ======================================================

announcementSchema.virtual(
  "isExpired"
).get(function () {
  if (!this.expireDate) {
    return false;
  }

  return (
    new Date() >
    new Date(this.expireDate)
  );
});

announcementSchema.virtual(
  "isPublished"
).get(function () {
  if (this.status !== "published") {
    return false;
  }

  if (
    this.postDate &&
    new Date(this.postDate) >
      new Date()
  ) {
    return false;
  }

  if (
    this.expireDate &&
    new Date(this.expireDate) <
      new Date()
  ) {
    return false;
  }

  return true;
});

// ======================================================
// Indexes
// ======================================================

// Branch announcement listing
announcementSchema.index(
  {
    branch: 1,
    status: 1,
    postDate: -1
  },
  {
    name:
      "announcement_branch_status_post_date_index"
  }
);

// Class announcement listing
announcementSchema.index(
  {
    branch: 1,
    targetClass: 1,
    status: 1,
    postDate: -1
  },
  {
    name:
      "announcement_branch_class_status_post_date_index"
  }
);

// Global announcement listing
announcementSchema.index(
  {
    targetType: 1,
    status: 1,
    postDate: -1
  },
  {
    name:
      "announcement_target_status_post_date_index"
  }
);

// Find expired announcements
announcementSchema.index(
  {
    status: 1,
    expireDate: 1
  },
  {
    name:
      "announcement_status_expire_date_index"
  }
);

// Announcements created by a user
announcementSchema.index(
  {
    postedBy: 1,
    createdAt: -1
  },
  {
    name:
      "announcement_posted_by_created_at_index"
  }
);

module.exports = mongoose.model(
  "Announcement",
  announcementSchema
);