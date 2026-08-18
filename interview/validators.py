from django.core.exceptions import ValidationError
import re


class WordCountValidator:
    """字数验证器类"""
    def __init__(self, max_words, field_name='内容'):
        self.max_words = max_words
        self.field_name = field_name

    def __call__(self, value):
        if not value:
            return
        words = re.findall(r'[\u4e00-\u9fff]|[a-zA-Z]+', value)
        word_count = len(words)
        if word_count > self.max_words:
            raise ValidationError(
                f'{self.field_name}不超过{self.max_words}个字，当前{word_count}个'
            )

    def __eq__(self, other):
        """用于迁移序列化比较"""
        if not isinstance(other, WordCountValidator):
            return False
        return (self.max_words == other.max_words and
                self.field_name == other.field_name)

    def deconstruct(self):
        return (
            'interview.validators.WordCountValidator',
            [],
            {
                'max_words': self.max_words,
                'field_name': self.field_name,
            },
        )