from django.db import models


class ContactMessage(models.Model):
    """
    A message submitted through the public Contact Us page. Visible to
    admins via Django admin and the admin API endpoint below — this is
    where "where does the message actually go" gets answered: it's
    stored here, not just faked on the frontend.
    """

    name = models.CharField(max_length=255)
    email = models.EmailField()
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "contact_messages"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["is_read"]),
        ]

    def __str__(self):
        return f"{self.name} <{self.email}> — {self.created_at:%Y-%m-%d}"
