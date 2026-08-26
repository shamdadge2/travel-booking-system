from rest_framework.pagination import PageNumberPagination


class StandardResultsPagination(PageNumberPagination):
    """
    Shared pagination class for function-based @api_view list endpoints.

    Function-based views don't get DEFAULT_PAGINATION_CLASS applied
    automatically the way generic class-based views do, so every list
    view instantiates this manually:

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = SomeSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    Clients can override the page size with ?page_size=25 up to
    max_page_size, and jump pages with ?page=2.
    """

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100
